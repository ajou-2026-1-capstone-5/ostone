package com.init.shared.infrastructure.airflow;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AirflowApiProperties.class)
public class AirflowApiConfig {}
