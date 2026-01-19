import { NextResponse } from 'next/server';

/**
 * Standardized API response format
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

/**
 * Create a successful response with data
 */
export function successResponse<T>(
    data: T,
    meta?: ApiResponse['meta'],
    status: number = 200
): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
        { success: true, data, meta },
        { status }
    );
}

/**
 * Create a successful response with a message
 */
export function messageResponse(
    message: string,
    status: number = 200
): NextResponse<ApiResponse> {
    return NextResponse.json(
        { success: true, message },
        { status }
    );
}

/**
 * Create an error response
 */
export function errorResponse(
    error: string,
    status: number = 400
): NextResponse<ApiResponse> {
    return NextResponse.json(
        { success: false, error },
        { status }
    );
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
    items: T[],
    page: number,
    limit: number,
    total: number
): NextResponse<ApiResponse<T[]>> {
    return NextResponse.json({
        success: true,
        data: items,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(
    message: string = 'Authentication required'
): NextResponse<ApiResponse> {
    return errorResponse(message, 401);
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(
    message: string = 'Access denied'
): NextResponse<ApiResponse> {
    return errorResponse(message, 403);
}

/**
 * Not found response (404)
 */
export function notFoundResponse(
    resource: string = 'Resource'
): NextResponse<ApiResponse> {
    return errorResponse(`${resource} not found`, 404);
}

/**
 * Internal error response (500)
 */
export function internalErrorResponse(
    error?: unknown,
    message: string = 'Internal server error'
): NextResponse<ApiResponse> {
    if (error) {
        console.error('[API Error]', error);
    }
    return errorResponse(message, 500);
}

/**
 * Get user info from middleware headers
 */
export function getUserFromHeaders(headers: Headers): { userId: string; role: string } | null {
    const userId = headers.get('x-user-id');
    const role = headers.get('x-user-role');

    if (!userId || !role) {
        return null;
    }

    return { userId, role };
}
