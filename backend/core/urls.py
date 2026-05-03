"""URL configuration for AST3 backend."""
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from strawberry.django.views import AsyncGraphQLView

from .schema import schema

urlpatterns = [
    # GraphQL — single endpoint
    path("graphql/", AsyncGraphQLView.as_view(schema=schema), name="graphql"),
    # Health probes
    path("healthz/", lambda request: __import__("django.http", fromlist=["HttpResponse"]).HttpResponse("ok"), name="healthz"),
    path("readyz/", lambda request: __import__("django.http", fromlist=["HttpResponse"]).HttpResponse("ok"), name="readyz"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
