"""Root GraphQL schema — composes all domain schemas."""
import strawberry
from strawberry.extensions import MaxAliasesExtension, MaxTokensExtension

from accounts.schema import AccountsMutation, AccountsQuery
from audit.schema import AuditQuery
from projects.schema import ProjectsMutation, ProjectsQuery
from tasks.schema import TasksMutation, TasksQuery
from tracking.schema import TrackingMutation, TrackingQuery
from risks.schema import RisksQuery


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
    extensions=[
        MaxAliasesExtension(max_aliases=10),
        MaxTokensExtension(max_tokens=1000),
    ],
)
