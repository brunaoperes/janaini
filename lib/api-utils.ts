import { NextResponse } from 'next/server';

/**
 * Cria uma resposta JSON com headers anti-cache
 * Previne que o navegador cache respostas da API
 */
export function jsonResponse<T>(
  data: T,
  options?: {
    status?: number;
    headers?: Record<string, string>;
  }
) {
  const response = NextResponse.json(data, { status: options?.status ?? 200 });

  // Headers anti-cache obrigatórios
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');

  // Headers adicionais customizados
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Cria uma resposta de erro padronizada
 */
export function errorResponse(
  message: string,
  status: number = 400
) {
  return jsonResponse({ error: message }, { status });
}

/**
 * Cria uma resposta de sucesso padronizada
 */
export function successResponse<T>(
  data: T,
  message?: string
) {
  return jsonResponse({
    success: true,
    message,
    data,
  });
}

/**
 * Resposta para não autorizado (401)
 */
export function unauthorizedResponse(message: string = 'Não autorizado') {
  return errorResponse(message, 401);
}

/**
 * Resposta para acesso negado (403)
 */
export function forbiddenResponse(message: string = 'Acesso negado') {
  return errorResponse(message, 403);
}

/**
 * Resposta para não encontrado (404)
 */
export function notFoundResponse(message: string = 'Não encontrado') {
  return errorResponse(message, 404);
}
