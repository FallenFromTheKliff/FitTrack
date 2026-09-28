export const HEALTH_CHECK_KINDS = Object.freeze({
  HTTP_2XX: 'http-2xx',
  FITTRACK_API: 'fittrack-api',
});

export function isSuccessfulHttpStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

export function isHealthyPayload(status, payload, kind = HEALTH_CHECK_KINDS.HTTP_2XX) {
  if (!isSuccessfulHttpStatus(status)) {
    return false;
  }

  if (kind !== HEALTH_CHECK_KINDS.FITTRACK_API) {
    return true;
  }

  const data = payload?.data;
  const services = data?.services;
  if (data?.status !== 'ok' || !services || typeof services !== 'object') {
    return false;
  }

  const serviceStatuses = Object.values(services);
  return serviceStatuses.length > 0 && serviceStatuses.every((value) => value === 'ok');
}

export async function testHealthUrl(
  url,
  {
    kind = HEALTH_CHECK_KINDS.HTTP_2XX,
    timeoutMs = 5000,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (typeof fetchImpl !== 'function') {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'manual',
    });

    if (!isSuccessfulHttpStatus(response.status)) {
      return false;
    }

    if (kind !== HEALTH_CHECK_KINDS.FITTRACK_API) {
      return true;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return false;
    }

    return isHealthyPayload(response.status, payload, kind);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
