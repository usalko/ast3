"""URL configuration for AST3 backend."""
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from .schema import schema


def health_check(_request):
    return HttpResponse("ok")

urlpatterns = [
    # GraphQL — single endpoint (CSRF exempt: protected via JWT tokens)
    path("graphql/", csrf_exempt(GraphQLView.as_view(schema=schema)), name="graphql"),

    # Health probes
    path("healthz/", health_check, name="healthz"),
    path("readyz/", health_check, name="readyz"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
