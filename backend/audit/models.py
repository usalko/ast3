"""Append-only audit log with SHA-256 hash chain (tamper-evident)."""
from __future__ import annotations

import hashlib
import json

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Immutable audit record. Never update or delete rows from this table."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        db_index=True,
    )
    action = models.CharField(max_length=128, db_index=True)
    resource_type = models.CharField(max_length=64, db_index=True)
    resource_id = models.CharField(max_length=64, db_index=True)
    payload = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    previous_hash = models.CharField(max_length=64, blank=True)
    entry_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["timestamp"]
        # Prevent accidental updates/deletes at DB level via triggers (add migration)

    def save(self, *args, **kwargs) -> None:  # type: ignore[override]
        if self.pk:
            raise ValueError("AuditLog entries are immutable")
        # Compute hash chain
        prev = AuditLog.objects.order_by("-timestamp").values_list("entry_hash", flat=True).first() or ""
        self.previous_hash = prev
        chain_input = json.dumps(
            {
                "actor_id": self.actor_id,
                "action": self.action,
                "resource_type": self.resource_type,
                "resource_id": self.resource_id,
                "payload": self.payload,
                "previous_hash": self.previous_hash,
            },
            sort_keys=True,
            default=str,
        ).encode()
        self.entry_hash = hashlib.sha256(chain_input).hexdigest()
        super().save(*args, **kwargs)

    @classmethod
    def log(
        cls,
        *,
        actor,
        action: str,
        resource_type: str,
        resource_id: str | int,
        payload: dict | None = None,
        request=None,
    ) -> "AuditLog":
        ip = None
        ua = ""
        if request:
            xff = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")
            ua = request.META.get("HTTP_USER_AGENT", "")[:512]
        return cls.objects.create(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            payload=payload or {},
            ip_address=ip,
            user_agent=ua,
        )
