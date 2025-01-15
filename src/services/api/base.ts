import Logger from '../logs';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleApiResponse<T>(response: Response, component: string): Promise<T> {
  if (!response.ok) {
    Logger.error('API request failed', {
      status: response.status,
      statusText: response.statusText
    }, component);
    throw new ApiError(
      `API request failed: ${response.statusText}`,
      response.status,
      response.statusText
    );
  }

  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    Logger.error('Failed to parse API response', error, component);
    throw new ApiError('Failed to parse API response');
  }
}

export async function handleApiError(error: unknown, component: string): Promise<never> {
  if (error instanceof ApiError) {
    throw error;
  }
  
  Logger.error('API request failed', error, component);
  throw new ApiError('API request failed');
} 