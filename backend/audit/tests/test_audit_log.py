"""Tests for audit log hash-chain integrity."""
import pytest

from audit.models import AuditLog


@pytest.mark.django_db
class TestAuditLog:
    def test_creates_entry(self, user):
        entry = AuditLog.log(
            actor=user,
            action="task.created",
            resource_type="Task",
            resource_id=1,
            payload={"title": "Test"},
        )
        assert entry.pk is not None
        assert entry.entry_hash

    def test_immutable(self, user):
        entry = AuditLog.log(
            actor=user,
            action="task.created",
            resource_type="Task",
            resource_id=1,
        )
        with pytest.raises(ValueError, match="immutable"):
            entry.save()

    def test_hash_chain(self, user):
        e1 = AuditLog.log(actor=user, action="a", resource_type="T", resource_id=1)
        e2 = AuditLog.log(actor=user, action="b", resource_type="T", resource_id=2)
        assert e2.previous_hash == e1.entry_hash
        assert e1.previous_hash == ""
