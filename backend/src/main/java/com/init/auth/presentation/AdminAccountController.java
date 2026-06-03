package com.init.auth.presentation;

import com.init.auth.application.CreateSuperAdminCommand;
import com.init.auth.application.CreateSuperAdminResult;
import com.init.auth.application.CreateSuperAdminUseCase;
import com.init.auth.presentation.dto.CreateSuperAdminRequest;
import com.init.auth.presentation.dto.CreateSuperAdminResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/super-admins")
public class AdminAccountController {

  private final CreateSuperAdminUseCase createSuperAdminUseCase;

  public AdminAccountController(CreateSuperAdminUseCase createSuperAdminUseCase) {
    this.createSuperAdminUseCase = createSuperAdminUseCase;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CreateSuperAdminResponse create(@Valid @RequestBody CreateSuperAdminRequest request) {
    CreateSuperAdminResult result =
        createSuperAdminUseCase.execute(
            new CreateSuperAdminCommand(request.name(), request.email(), request.password()));
    return new CreateSuperAdminResponse(result.id(), result.email(), result.name(), result.role());
  }
}
