plugins {
    id("java")
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.7"
    id("checkstyle")
    id("com.diffplug.spotless") version "6.25.0"
    id("jacoco")
    id("org.sonarqube") version "7.2.3.7755"
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

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.liquibase:liquibase-core")
    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")
    runtimeOnly("org.postgresql:postgresql")
    implementation(platform("software.amazon.awssdk:bom:2.26.7"))
    implementation("software.amazon.awssdk:s3")
    testImplementation("com.h2database:h2")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<Test> {
    useJUnitPlatform()
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
        property("sonar.coverage.jacoco.xmlReportPaths",
            "${layout.buildDirectory.get().asFile.path}/reports/jacoco/test/jacocoTestReport.xml")
        property("sonar.exclusions",
            "**/build/**,**/generated/**")
        property("sonar.coverage.exclusions",
            "**/dto/**/*,**/entity/**/*,**/config/**,**/*Application.java,**/infrastructure/**/*")
    }
}

// org.sonarqube 7.2.x automatically configures this dependency; kept for explicit documentation.
tasks.named("sonar") {
    dependsOn(tasks.jacocoTestReport)
}
