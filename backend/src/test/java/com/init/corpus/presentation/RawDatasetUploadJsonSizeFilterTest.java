package com.init.corpus.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.util.unit.DataSize;

class RawDatasetUploadJsonSizeFilterTest {

  @Test
  @DisplayName("본문 크기 제한이 양수가 아니면 필터를 생성하지 않는다")
  void shouldRejectNonPositiveMaxBodySize() {
    ObjectMapper objectMapper = new ObjectMapper();

    assertThatThrownBy(() -> new RawDatasetUploadJsonSizeFilter(objectMapper, DataSize.ofBytes(0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("positive");
  }

  @Test
  @DisplayName("Raw JSON 업로드 요청이 아니면 본문 크기를 검사하지 않는다")
  void shouldBypassWhenRequestDoesNotTargetRawJsonUpload() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(8));
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/api/v1/workspaces/1/datasets");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setContent("{\"large\":\"payload\"}".getBytes(StandardCharsets.UTF_8));
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean downstreamCalled = new AtomicBoolean(false);

    filter.doFilter(
        request, response, (servletRequest, servletResponse) -> downstreamCalled.set(true));

    assertThat(response.getStatus()).isEqualTo(200);
    assertThat(downstreamCalled).isTrue();
  }

  @Test
  @DisplayName("Raw JSON 업로드 POST가 아니면 본문 크기를 검사하지 않는다")
  void shouldBypassWhenMethodIsNotPost() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(8));
    MockHttpServletRequest request =
        new MockHttpServletRequest("GET", "/api/v1/workspaces/1/datasets/raw");
    request.setContent("{\"large\":\"payload\"}".getBytes(StandardCharsets.UTF_8));
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean downstreamCalled = new AtomicBoolean(false);

    filter.doFilter(
        request, response, (servletRequest, servletResponse) -> downstreamCalled.set(true));

    assertThat(response.getStatus()).isEqualTo(200);
    assertThat(downstreamCalled).isTrue();
  }

  @Test
  @DisplayName("Content-Length가 제한 이하이면 원본 request를 downstream으로 전달한다")
  void shouldPassOriginalRequestWhenContentLengthIsWithinLimit() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(128));
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/api/v1/workspaces/1/datasets/raw");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setContent("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicReference<Object> downstreamRequest = new AtomicReference<>();

    filter.doFilter(
        request,
        response,
        (servletRequest, servletResponse) -> downstreamRequest.set(servletRequest));

    assertThat(response.getStatus()).isEqualTo(200);
    assertThat(downstreamRequest.get()).isSameAs(request);
  }

  @Test
  @DisplayName("Content-Length가 제한을 넘으면 413과 최대 바이트 정보를 반환한다")
  void shouldRejectWhenContentLengthExceedsLimit() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(8));
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/api/v1/workspaces/1/datasets/raw");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setContent("{\"tooLarge\":true}".getBytes(StandardCharsets.UTF_8));
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean downstreamCalled = new AtomicBoolean(false);

    filter.doFilter(
        request, response, (servletRequest, servletResponse) -> downstreamCalled.set(true));

    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getHeader("X-Raw-Json-Max-Body-Bytes")).isEqualTo("8");
    assertThat(response.getContentAsString()).contains("8B", "uploads:init");
    assertThat(downstreamCalled).isFalse();
  }

  @Test
  @DisplayName("context path를 제외한 Raw JSON 업로드 경로를 검사한다")
  void shouldMatchRawJsonUploadPathAfterContextPath() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofKilobytes(1));
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/app/api/v1/workspaces/1/datasets/raw");
    request.setContextPath("/app");
    request.setContentType(MediaType.APPLICATION_JSON_VALUE);
    request.setContent("x".repeat(1025).getBytes(StandardCharsets.UTF_8));
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(request, response, (servletRequest, servletResponse) -> {});

    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getContentAsString()).contains("1KB");
  }

  @Test
  @DisplayName("Content-Length 없는 제한 이하 본문 → downstream에서 동일 body를 읽을 수 있다")
  void shouldCacheBodyForDownstreamWhenContentLengthUnknownAndWithinLimit() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(128));
    byte[] payload = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
    MockHttpServletRequest baseRequest =
        new MockHttpServletRequest("POST", "/api/v1/workspaces/1/datasets/raw");
    baseRequest.setContentType(MediaType.APPLICATION_JSON_VALUE);
    baseRequest.setCharacterEncoding(StandardCharsets.UTF_8.name());
    baseRequest.setContent(payload);
    HttpServletRequest request = new UnknownContentLengthRequest(baseRequest);
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicReference<String> downstreamBody = new AtomicReference<>();
    AtomicReference<String> downstreamReaderBody = new AtomicReference<>();
    AtomicReference<Integer> downstreamContentLength = new AtomicReference<>();
    AtomicReference<Long> downstreamContentLengthLong = new AtomicReference<>();
    AtomicBoolean onDataAvailableCalled = new AtomicBoolean(false);
    AtomicBoolean onAllDataReadCalled = new AtomicBoolean(false);
    AtomicBoolean onAllDataReadAfterFinishedCalled = new AtomicBoolean(false);
    AtomicReference<Throwable> listenerError = new AtomicReference<>();
    FilterChain chain =
        (servletRequest, servletResponse) -> {
          HttpServletRequest cachedRequest = (HttpServletRequest) servletRequest;
          downstreamContentLength.set(cachedRequest.getContentLength());
          downstreamContentLengthLong.set(cachedRequest.getContentLengthLong());
          downstreamReaderBody.set(cachedRequest.getReader().readLine());

          ServletInputStream readyStream = cachedRequest.getInputStream();
          readyStream.setReadListener(
              new ReadListener() {
                @Override
                public void onDataAvailable() {
                  onDataAvailableCalled.set(true);
                }

                @Override
                public void onAllDataRead() {
                  onAllDataReadCalled.set(true);
                }

                @Override
                public void onError(Throwable throwable) {}
              });

          ServletInputStream bodyStream = cachedRequest.getInputStream();
          downstreamBody.set(new String(bodyStream.readAllBytes(), StandardCharsets.UTF_8));
          assertThat(bodyStream.isReady()).isTrue();
          assertThat(bodyStream.isFinished()).isTrue();

          ServletInputStream finishedStream = cachedRequest.getInputStream();
          assertThat(finishedStream.readAllBytes()).isEqualTo(payload);
          finishedStream.setReadListener(
              new ReadListener() {
                @Override
                public void onDataAvailable() {}

                @Override
                public void onAllDataRead() {
                  onAllDataReadAfterFinishedCalled.set(true);
                }

                @Override
                public void onError(Throwable throwable) {}
              });
          assertThatThrownBy(() -> finishedStream.setReadListener(null))
              .isInstanceOf(IllegalArgumentException.class);

          ServletInputStream failingStream = cachedRequest.getInputStream();
          failingStream.setReadListener(
              new ReadListener() {
                @Override
                public void onDataAvailable() throws IOException {
                  throw new IOException("listener failed");
                }

                @Override
                public void onAllDataRead() {}

                @Override
                public void onError(Throwable throwable) {
                  listenerError.set(throwable);
                }
              });
        };

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(200);
    assertThat(downstreamBody.get()).isEqualTo("{\"ok\":true}");
    assertThat(downstreamReaderBody.get()).isEqualTo("{\"ok\":true}");
    assertThat(downstreamContentLength.get()).isEqualTo(payload.length);
    assertThat(downstreamContentLengthLong.get()).isEqualTo(payload.length);
    assertThat(onDataAvailableCalled).isTrue();
    assertThat(onAllDataReadCalled).isFalse();
    assertThat(onAllDataReadAfterFinishedCalled).isTrue();
    assertThat(listenerError.get()).isInstanceOf(IOException.class);
  }

  @Test
  @DisplayName("Content-Length 없는 제한 초과 본문 → 413 반환 후 downstream을 호출하지 않는다")
  void shouldRejectBeforeDownstreamWhenContentLengthUnknownAndExceeded() throws Exception {
    RawDatasetUploadJsonSizeFilter filter =
        new RawDatasetUploadJsonSizeFilter(new ObjectMapper(), DataSize.ofBytes(8));
    MockHttpServletRequest baseRequest =
        new MockHttpServletRequest("POST", "/api/v1/workspaces/1/datasets/raw");
    baseRequest.setContentType(MediaType.APPLICATION_JSON_VALUE);
    baseRequest.setContent("{\"tooLarge\":true}".getBytes(StandardCharsets.UTF_8));
    HttpServletRequest request = new UnknownContentLengthRequest(baseRequest);
    MockHttpServletResponse response = new MockHttpServletResponse();
    AtomicBoolean downstreamCalled = new AtomicBoolean(false);

    filter.doFilter(
        request, response, (servletRequest, servletResponse) -> downstreamCalled.set(true));

    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getContentAsString()).contains(RawDatasetUploadJsonSizeFilter.ERROR_CODE);
    assertThat(downstreamCalled).isFalse();
  }

  private static class UnknownContentLengthRequest extends HttpServletRequestWrapper {

    UnknownContentLengthRequest(HttpServletRequest request) {
      super(request);
    }

    @Override
    public int getContentLength() {
      return -1;
    }

    @Override
    public long getContentLengthLong() {
      return -1;
    }
  }
}
