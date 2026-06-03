plugins {
    id("java")
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
    id("checkstyle")
    id("com.diffplug.spotless") version "6.25.0"
    id("jacoco")
    id("org.sonarqube") version "7.2.3.7755"
    id("org.springdoc.openapi-gradle-plugin") version "1.9.0"
}

group = "com.ajou.capstone"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencyLocking {
    lockAllConfigurations()
}

// CVE overrides: Spring Boot BOM property keys override all modules in each group
extra["tomcat.version"] = "10.1.54"           // CVE-2025-55752, CVE-2025-49125, CVE-2025-55668
extra["spring-security.version"] = "6.4.10"  // CVE-2025-41232, CVE-2025-41248
extra["netty.version"] = "4.1.133.Final"      // CVE-2025-67735, CVE-2026-42583

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-websocket")
    implementation("org.springframework.security:spring-security-messaging")
    implementation(platform("org.springframework.ai:spring-ai-bom:1.0.4"))
    implementation("org.springframework.ai:spring-ai-starter-model-openai")
    implementation("org.springframework.ai:spring-ai-starter-model-bedrock-converse")
    implementation("org.liquibase:liquibase-core")
    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")
    runtimeOnly("org.postgresql:postgresql")
    implementation(enforcedPlatform("software.amazon.awssdk:bom:2.41.30"))
    implementation("software.amazon.awssdk:s3")
    implementation("software.amazon.awssdk:bedrockruntime")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.6")
    testImplementation("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.bootJar {
    archiveFileName.set("app.jar")
}

checkstyle {
    toolVersion = "10.17.0"
    configFile = file("${projectDir}/config/checkstyle/checkstyle.xml")
}

spotless {
    java {
        googleJavaFormat()
        target("src/**/*.java")
    }
}

jacoco {
    toolVersion = "0.8.12"
}

tasks.jacocoTestReport {
    reports {
        xml.required.set(true)
        html.required.set(false)
    }
    dependsOn(tasks.test)
}

sonar {
    properties {
        property("sonar.projectKey", "ajou-2026-1-capstone-5_ostone_backend")
        property("sonar.organization", "ajou-2026-1-capstone-5")
        property("sonar.host.url", "https://sonarcloud.io")
        // CI 러너에 이미 설치된 JDK 21을 스캐너 런타임으로 사용한다. SonarCloud JRE 자동
        // 프로비저닝(api.sonarcloud.io/analysis/jres)이 간헐적으로 403을 반환해 backend-sonar가
        // flaky하게 실패하던 것을 방지한다. frontend/ml은 JRE 번들 scan-action이라 영향 없음.
        property("sonar.scanner.skipJreProvisioning", "true")
        property("sonar.coverage.jacoco.xmlReportPaths",
            "${layout.buildDirectory.get().asFile.path}/reports/jacoco/test/jacocoTestReport.xml")
        property("sonar.exclusions",
            "**/build/**,**/generated/**")
        property("sonar.coverage.exclusions",
            "**/dto/**/*,**/entity/**/*,**/config/**,**/*Application.java," +
                "**/infrastructure/**/*,**/application/**/*Command.java")
        property("sonar.cpd.exclusions",
            "**/pipelinejob/application/AddWorkflowDraftPortCommand.java," +
            "**/pipelinejob/application/CreateDomainPackDraftPortCommand.java," +
            "**/pipelinejob/application/CreateDomainPackDraftPortResult.java," +
            "**/pipelinejob/application/AddIntentsToDraftVersionPortCommand.java," +
            "**/pipelinejob/application/AddIntentsToDraftVersionPortResult.java," +
            "**/pipelinejob/application/IntentDraftInput.java")
    }
}

// org.sonarqube 7.2.x automatically configures this dependency; kept for explicit documentation.
tasks.named("sonar") {
    dependsOn(tasks.jacocoTestReport)
}

openApi {
    apiDocsUrl.set("http://localhost:8089/v3/api-docs")
    outputDir.set(file("$buildDir"))
    outputFileName.set("openapi.json")
    waitTimeInSeconds.set(60)
    customBootRun {
        args.set(listOf("--spring.profiles.active=local", "--server.port=8089"))
    }
}
