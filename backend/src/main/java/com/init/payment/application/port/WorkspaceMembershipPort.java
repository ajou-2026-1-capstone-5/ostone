package com.init.payment.application.port;

import java.util.Set;

/** 결제 BC가 워크스페이스 멤버십 인가를 확인하기 위한 anti-corruption port (U-015). */
public interface WorkspaceMembershipPort {

  boolean existsById(Long workspaceId);

  boolean hasAnyRole(Long workspaceId, Long userId, Set<String> roles);
}
