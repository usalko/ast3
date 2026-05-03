"""Locust load test — basic project/task read scenario."""
from locust import HttpUser, task, between
import json

GRAPHQL = "/graphql/"


class ProjectsUser(HttpUser):
    wait_time = between(1, 3)
    token: str = ""

    def on_start(self):
        """Authenticate before running tasks."""
        resp = self.client.post(
            GRAPHQL,
            json={
                "query": """
                mutation {
                  tokenObtainPair(email: "loadtest@ast3.internal", password: "LoadTest1!") {
                    access
                  }
                }
                """
            },
        )
        data = resp.json()
        self.token = data.get("data", {}).get("tokenObtainPair", {}).get("access", "")

    def _gql(self, query: str):
        return self.client.post(
            GRAPHQL,
            json={"query": query},
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(3)
    def list_projects(self):
        self._gql("{ projects { id name status } }")

    @task(2)
    def list_tasks(self):
        self._gql("{ tasks(projectId: \"1\") { id title priority } }")

    @task(1)
    def me(self):
        self._gql("{ me { id email fullName } }")
