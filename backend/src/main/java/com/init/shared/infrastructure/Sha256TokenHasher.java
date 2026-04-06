package com.init.shared.infrastructure;

import com.init.shared.application.TokenHasher;
import com.init.shared.infrastructure.util.HashUtils;
import org.springframework.stereotype.Component;

@Component
public class Sha256TokenHasher implements TokenHasher {

  @Override
  public String hash(String input) {
    return HashUtils.sha256Hex(input);
  }
}
