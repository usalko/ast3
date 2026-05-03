"""Password strength validator using zxcvbn."""
from django.core.exceptions import ValidationError


class ZxcvbnPasswordValidator:
    MIN_SCORE = 2

    def validate(self, password, user=None):
        try:
            from zxcvbn import zxcvbn  # type: ignore[import]
        except ImportError:
            return  # graceful degradation if not installed

        user_inputs = []
        if user:
            user_inputs = [
                getattr(user, "email", ""),
                getattr(user, "first_name", ""),
                getattr(user, "last_name", ""),
            ]
        result = zxcvbn(password, user_inputs=user_inputs)
        if result["score"] < self.MIN_SCORE:
            feedback = result.get("feedback", {})
            suggestions = " ".join(feedback.get("suggestions", []))
            raise ValidationError(
                f"Password is too weak. {suggestions}",
                code="password_too_weak",
            )

    def get_help_text(self):
        return "Your password must be reasonably complex (not a dictionary word or simple pattern)."
