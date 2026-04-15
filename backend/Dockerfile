FROM eclipse-temurin:21-jdk AS builder

WORKDIR /app

COPY gradlew gradlew
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
COPY config config
COPY src src

RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl=8.5.0-2ubuntu10.8 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/build/libs/backend-*.jar app.jar

RUN addgroup --system appgroup && adduser --system --group appuser
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl --fail --silent --show-error http://127.0.0.1:8080/actuator/health > /dev/null || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
