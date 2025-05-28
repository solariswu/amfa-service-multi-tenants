#!/bin/bash

# aPersona Adaptive Security Manager URLS and Installation key, REQUIRED
export ASM_PORTAL_URL='https://asm.apersona.com/asm_portal' ## ASM portal url, example 'https://asm.apersona.com/asm_portal'
export ASM_SERVICE_URL='https://asm.apersona.com/asm' ## ASM portal url, example 'https://asm.apersona.com/asm'
export ASM_INSTAL_KEY='' ## example 'd5a0dc1295d7839ab31cb9a8aefb1bbf' Your install key received after registration.

# deployment tenant info, REQUIRED
export TENANT_ID='' ## Short company or division ID. example 'abc-co' (must be lower case, no spaces.)
export TENANT_NAME='' ## example 'Company Name',.
export ADMIN_EMAIL='' ## example 'installer.admin@yourdomain.com' (MUST BE THE SAME AS AWS ADMIN USER!!)

# Additional Installer / Admin, OPTIONAL
export INSTALLER_EMAIL='' ## example 'admin2@yourdomain.com'

# DNS domain and hosted zone id, REQUIRED
export ROOT_DOMAIN_NAME='' ## example 'yourdomain.com' (must be lower case, no spaces.)
export ROOT_HOSTED_ZONE_ID='' ## example 'Z0596003151J12345678X'

# Your SMTP server info for sending email to end users, REQUIRED
# Can be adjusted after installation via Admin Portal.
export SMTP_HOST='' ## example 'smtp.gmail.com' or 'smtp.office365.com'
export SMTP_USER='' ## example '<YOUR_SMTP_SENDER_USERNAME>' example 'notify@yourdomain.com'
export SMTP_PASS='' ## example 'BQj1234567890'
export SMTP_SECURE='' ## example 'false', default value is 'false'. Use 'true' if port is 465.
export SMTP_PORT='' ## example '587', or '465' default value is '587'

# Google captcha key and secret for your ROOT_DOMAIN_NAME. OPTIONAL
export RECAPTCHA_KEY='' ## example '7PfnWYUnDCFEAH5TdjfhjNZqDqPOEn12345678'
export RECAPTCHA_SECRET='' ## example '7PfnWisqDCFEAH52WKcwV_NcrGb0LYbhZrOyKQ--'

# Salt for local cookie encryption used by the aPersona login controller, REQUIRED
# This value should be a random 24 to 32 alpha numeric character string.
export ASM_SALT='' ## example '7rH34SawJQ18Pn5Df7S892KxS57aZxyp'
