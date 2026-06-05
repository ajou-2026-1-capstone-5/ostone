package com.init.corpus.presentation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.presentation.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RawDatasetUploadJsonSizeFilter extends OncePerRequestFilter {

  static final String ERROR_CODE = "RAW_JSON_UPLOAD_TOO_LARGE";

  private static final Pattern RAW_JSON_UPLOAD_PATH =
      Pattern.compile("/api/v1/workspaces/[^/]+/datasets/raw");
  private static final int BUFFER_SIZE = 8192;

  private final ObjectMapper objectMapper;
  private final long maxBodyBytes;

  public RawDatasetUploadJsonSizeFilter(
      ObjectMapper objectMapper,
      @Value("${app.corpus.raw-json-upload.max-body-size:1MB}") DataSize maxBodySize) {
    if (maxBodySize.toBytes() <= 0) {
      throw new IllegalArgumentException("raw JSON upload max body size must be positive");
    }
    this.objectMapper = objectMapper;
    this.maxBodyBytes = maxBodySize.toBytes();
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !HttpMethod.POST.matches(request.getMethod()) || !isRawJsonUploadPath(request);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    long contentLength = request.getContentLengthLong();
    if (contentLength > maxBodyBytes) {
      writePayloadTooLarge(response);
      return;
    }
    if (contentLength >= 0) {
      filterChain.doFilter(request, response);
      return;
    }

    LimitedBody body = readBodyWithinLimit(request);
    if (body.exceeded()) {
      writePayloadTooLarge(response);
      return;
    }
    filterChain.doFilter(new CachedBodyRequest(request, body.bytes()), response);
  }

  private boolean isRawJsonUploadPath(HttpServletRequest request) {
    String path = request.getRequestURI();
    String contextPath = request.getContextPath();
    if (contextPath != null && !contextPath.isBlank() && path.startsWith(contextPath)) {
      path = path.substring(contextPath.length());
    }
    return RAW_JSON_UPLOAD_PATH.matcher(path).matches();
  }

  private LimitedBody readBodyWithinLimit(HttpServletRequest request) throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ServletInputStream inputStream = request.getInputStream();
    byte[] buffer = new byte[BUFFER_SIZE];
    long totalBytes = 0;
    int readBytes;
    while ((readBytes = inputStream.read(buffer)) != -1) {
      totalBytes += readBytes;
      if (totalBytes > maxBodyBytes) {
        return LimitedBody.overLimit();
      }
      output.write(buffer, 0, readBytes);
    }
    return LimitedBody.withinLimit(output.toByteArray());
  }

  private void writePayloadTooLarge(HttpServletResponse response) throws IOException {
    response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
    response.setHeader("X-Raw-Json-Max-Body-Bytes", Long.toString(maxBodyBytes));
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(
        response.getWriter(),
        new ErrorResponse(
            ERROR_CODE,
            "JSON 업로드 본문은 최대 "
                + maxBodySizeLabel()
                + "입니다. 대용량 데이터셋은 presigned 파일 업로드"
                + "(/api/v1/workspaces/{workspaceId}/datasets/uploads:init) 흐름을 사용하세요."));
  }

  private String maxBodySizeLabel() {
    long mebibyte = 1024L * 1024;
    if (maxBodyBytes % mebibyte == 0) {
      return (maxBodyBytes / mebibyte) + "MB";
    }
    if (maxBodyBytes % 1024 == 0) {
      return (maxBodyBytes / 1024) + "KB";
    }
    return maxBodyBytes + "B";
  }

  private static final class LimitedBody {

    private final byte[] bytes;
    private final boolean exceeded;

    private LimitedBody(byte[] bytes, boolean exceeded) {
      this.bytes = bytes.clone();
      this.exceeded = exceeded;
    }

    private static LimitedBody withinLimit(byte[] bytes) {
      return new LimitedBody(bytes, false);
    }

    private static LimitedBody overLimit() {
      return new LimitedBody(new byte[0], true);
    }

    private byte[] bytes() {
      return bytes.clone();
    }

    private boolean exceeded() {
      return exceeded;
    }
  }

  private static class CachedBodyRequest extends HttpServletRequestWrapper {

    private final byte[] body;

    CachedBodyRequest(HttpServletRequest request, byte[] body) {
      super(request);
      this.body = body.clone();
    }

    @Override
    public ServletInputStream getInputStream() {
      return new CachedBodyServletInputStream(body);
    }

    @Override
    public BufferedReader getReader() throws IOException {
      Charset charset =
          getCharacterEncoding() == null
              ? StandardCharsets.UTF_8
              : Charset.forName(getCharacterEncoding());
      return new BufferedReader(new InputStreamReader(getInputStream(), charset));
    }

    @Override
    public int getContentLength() {
      return body.length;
    }

    @Override
    public long getContentLengthLong() {
      return body.length;
    }
  }

  private static class CachedBodyServletInputStream extends ServletInputStream {

    private final ByteArrayInputStream inputStream;

    CachedBodyServletInputStream(byte[] body) {
      this.inputStream = new ByteArrayInputStream(body);
    }

    @Override
    public int read() {
      return inputStream.read();
    }

    @Override
    public boolean isFinished() {
      return inputStream.available() == 0;
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setReadListener(ReadListener readListener) {
      if (readListener == null) {
        throw new IllegalArgumentException("readListener must not be null");
      }
      try {
        if (!isFinished()) {
          readListener.onDataAvailable();
        }
        if (isFinished()) {
          readListener.onAllDataRead();
        }
      } catch (IOException e) {
        readListener.onError(e);
      }
    }
  }
}
