FROM eclipse-temurin:21-jre

WORKDIR /app

COPY build/libs/backend-*.jar app.jar

RUN addgroup --system appgroup && adduser --system --group appuser
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
