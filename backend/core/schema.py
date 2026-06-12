"""Root GraphQL schema — composes all domain schemas."""
import strawberry

# `strawberry.extensions` may not expose MaxAliasesExtension/MaxTokensExtension
# across versions. Import defensively and fall back to no extensions when missing.
try:
    from strawberry.extensions import MaxAliasesExtension, MaxTokensExtension
    _STRAWBERRY_EXTENSIONS = [
        MaxAliasesExtension(max_aliases=10),
        MaxTokensExtension(max_tokens=1000),
    ]
except Exception:
    _STRAWBERRY_EXTENSIONS = []

from accounts.schema import AccountsMutation, AccountsQuery
from audit.schema import AuditQuery
from projects.schema import ProjectsMutation, ProjectsQuery
from risks.schema import RisksQuery
from tasks.schema import TasksMutation, TasksQuery
from tracking.schema import TrackingMutation, TrackingQuery


@strawberry.type
class Query(
    AccountsQuery,
    ProjectsQuery,
    TasksQuery,
    TrackingQuery,
    RisksQuery,
    AuditQuery,
):
    pass


@strawberry.type
class Mutation(
    AccountsMutation,
    ProjectsMutation,
    TasksMutation,
    TrackingMutation,
):
    pass


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    extensions=_STRAWBERRY_EXTENSIONS,
)
