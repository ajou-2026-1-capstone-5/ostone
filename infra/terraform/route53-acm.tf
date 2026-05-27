resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = var.domain_name
  }
}

resource "aws_acm_certificate" "regional" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-regional-wildcard-cert"
  }
}

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-cloudfront-wildcard-cert"
  }
}

locals {
  acm_validation_options = concat(
    tolist(aws_acm_certificate.regional.domain_validation_options),
    tolist(aws_acm_certificate.cloudfront.domain_validation_options)
  )

  acm_validation_records = {
    for option in local.acm_validation_options : option.resource_record_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = local.acm_validation_records

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "regional" {
  certificate_arn = aws_acm_certificate.regional.arn
  validation_record_fqdns = [
    for option in aws_acm_certificate.regional.domain_validation_options :
    aws_route53_record.acm_validation[option.resource_record_name].fqdn
  ]
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [
    for option in aws_acm_certificate.cloudfront.domain_validation_options :
    aws_route53_record.acm_validation[option.resource_record_name].fqdn
  ]
}
