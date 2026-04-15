FROM apache/airflow:3.1.8-python3.13

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl=7.88.1-10+deb12u14 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/airflow/dags /opt/airflow/src /opt/airflow/logs /opt/airflow/artifacts /opt/airflow/auth /opt/airflow/scripts \
    && chown -R airflow:0 /opt/airflow \
    && chmod -R g+rwX /opt/airflow

COPY requirements.txt /requirements.txt
COPY scripts/init-airflow.sh /opt/airflow/scripts/init-airflow.sh

RUN chmod +x /opt/airflow/scripts/init-airflow.sh

USER airflow

RUN pip install --no-cache-dir -r /requirements.txt
