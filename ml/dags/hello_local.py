from __future__ import annotations

from datetime import datetime

from airflow.sdk import dag, task


@dag(
    dag_id="hello_local",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["dev", "hello"],
)
def hello_local() -> None:
    @task(task_id="say_hello")
    def say_hello() -> str:
        return "hello from airflow"

    @task(task_id="say_goodbye")
    def say_goodbye(message: str) -> None:
        print(f"{message} -> goodbye from airflow")

    say_goodbye(say_hello())


hello_local()
