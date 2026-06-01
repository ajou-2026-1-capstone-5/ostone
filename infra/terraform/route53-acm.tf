data "aws_route53_zone" "main" {
  count = trimspace(var.route53_zone_id) == "" && !var.manage_route53_zone ? 1 : 0

  name         = var.domain_name
  private_zone = false
}

resource "aws_route53_zone" "main" {
  count = var.manage_route53_zone ? 1 : 0

  name = var.domain_name

  tags = {
    Name = var.domain_name
  }
}

locals {
  route53_zone_id = trimspace(var.route53_zone_id) != "" ? trimspace(var.route53_zone_id) : (
    var.manage_route53_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.main[0].zone_id
  )

  route53_name_servers = var.manage_route53_zone ? aws_route53_zone.main[0].name_servers : []
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

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for option in aws_acm_certificate.regional.domain_validation_options : option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  zone_id = local.route53_zone_id
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
    aws_route53_record.acm_validation[option.domain_name].fqdn
  ]
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [
    for option in aws_acm_certificate.cloudfront.domain_validation_options :
    aws_route53_record.acm_validation[option.domain_name].fqdn
  ]
}
