FROM eclipse-temurin:21-jre

WORKDIR /app

# Note: Run `./gradlew bootJar` before docker build to generate app.jar
COPY build/libs/backend-*.jar app.jar

RUN addgroup --system appgroup && adduser --system --group appuser
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
