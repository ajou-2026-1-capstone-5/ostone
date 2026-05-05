package com.init.pipelinejob.infrastructure.airflow;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AirflowApiProperties.class)
public class AirflowApiConfig {}
