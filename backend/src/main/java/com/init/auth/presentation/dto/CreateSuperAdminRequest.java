package com.init.auth.presentation.dto;

import com.init.auth.presentation.validation.Utf8ByteSize;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSuperAdminRequest(
    @NotBlank(message = "이름은 필수입니다.") @Size(max = 255, message = "이름은 255자 이하여야 합니다.") String name,
    @NotBlank(message = "이메일은 필수입니다.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        @Size(max = 254, message = "이메일은 254자 이하여야 합니다.")
        String email,
    @NotBlank(message = "비밀번호는 필수입니다.")
        @Size(min = 8, max = 72, message = "비밀번호는 8자 이상 72자 이하여야 합니다.")
        @Utf8ByteSize(min = 8, max = 72, message = "비밀번호는 UTF-8 기준 8바이트 이상 72바이트 이하여야 합니다.")
        String password) {}
