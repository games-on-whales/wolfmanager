import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { SocketService } from '@/lib/services/socket-service';
import { logger, LogComponent } from '@/lib/logger';

/**
 * Wolf Events Source API endpoint
 * Provides Server-Sent Events (SSE) stream of Wolf events
 * 
 * This endpoint connects to Wolf's actual event stream via SocketService
 * and forwards events to the WolfEventService in SSE format.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(LogComponent.API, 'Wolf events SSE access denied - no session', {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
      });
      return new NextResponse('Unauthorized', { status: 401 });
    }

    logger.info(LogComponent.API, 'Wolf events SSE connection requested', {
      userId: session.user.id,
      userAgent: request.headers.get('user-agent'),
    });

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        logger.debug(LogComponent.API, 'Starting Wolf events SSE stream');

        // Set up SSE connection using SocketService
        const socketService = SocketService.getInstance();
        
        // Function to send SSE formatted data
        const sendSSEData = (data: any, eventType?: string) => {
          try {
            const sseData = eventType 
              ? `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
              : `data: ${JSON.stringify(data)}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(sseData));
          } catch (error) {
            logger.error(LogComponent.API, 'Error encoding SSE data', error, { data });
          }
        };

        // Send initial connection event
        sendSSEData({ type: 'connected', timestamp: new Date().toISOString() }, 'connection');

        let eventStream: any = null;

        try {
          // Connect to Wolf's event stream using internal method
          logger.debug(LogComponent.API, 'Connecting to Wolf /events endpoint');
          eventStream = await socketService.callWolfApiStreamInternal('/events');
          
          logger.info(LogComponent.API, 'Connected to Wolf events stream');

          // Handle incoming data from Wolf
          eventStream.on('data', (chunk: Buffer) => {
            try {
              const message = chunk.toString();
              logger.debug(LogComponent.API, 'Received Wolf event chunk', {
                chunkLength: message.length,
                preview: message.substring(0, 100)
              });

              // SSE messages are separated by double newlines
              const events = message.split('\n\n');
              
              for (const event of events) {
                if (event.trim() === '') continue;

                try {
                  // Parse SSE formatted data from Wolf
                  if (event.startsWith('data: ')) {
                    const data = event.substring(6).trim();
                    if (data) {
                      try {
                        const eventData = JSON.parse(data);
                        
                        // Determine event type based on data structure
                        let eventType = 'wolf-event';
                        if (eventData.type) {
                          eventType = eventData.type;
                        } else if (eventData.event_type) {
                          eventType = eventData.event_type;
                        }

                        logger.debug(LogComponent.API, 'Forwarding Wolf event', { 
                          eventType, 
                          hasClientId: !!eventData.clientId 
                        });
                        
                        // Forward the event via SSE
                        sendSSEData(eventData, eventType);

                      } catch (parseError) {
                        logger.warn(LogComponent.API, 'Failed to parse Wolf event JSON', parseError, { 
                          data: data.substring(0, 200)
                        });
                        
                        // Send raw data if parsing fails
                        sendSSEData({ 
                          raw: data, 
                          timestamp: new Date().toISOString() 
                        }, 'raw-event');
                      }
                    }
                  } else if (event.startsWith('event: ')) {
                    // Handle event type lines - these are metadata for the next data line
                    logger.debug(LogComponent.API, 'Received Wolf event type', { event });
                  } else {
                    // Handle other SSE formats or raw JSON
                    try {
                      const eventData = JSON.parse(event);
                      
                      let eventType = 'wolf-event';
                      if (eventData.type) {
                        eventType = eventData.type;
                      }

                      logger.debug(LogComponent.API, 'Forwarding Wolf event (non-SSE format)', { eventType });
                      sendSSEData(eventData, eventType);

                    } catch (parseError) {
                      logger.debug(LogComponent.API, 'Ignoring non-JSON Wolf event line', { 
                        line: event.substring(0, 50) 
                      });
                    }
                  }
                } catch (eventError) {
                  logger.error(LogComponent.API, 'Error processing Wolf event', eventError, {
                    event: event.substring(0, 200)
                  });
                }
              }
            } catch (chunkError) {
              logger.error(LogComponent.API, 'Error processing Wolf events stream chunk', chunkError);
            }
          });

          // Handle stream end
          eventStream.on('end', () => {
            logger.info(LogComponent.API, 'Wolf events stream ended');
            sendSSEData({ 
              type: 'disconnected', 
              reason: 'stream_ended',
              timestamp: new Date().toISOString() 
            }, 'connection');
            
            try {
              controller.close();
            } catch (closeError) {
              logger.debug(LogComponent.API, 'Controller already closed', closeError);
            }
          });

          // Handle stream errors
          eventStream.on('error', (error: Error) => {
            logger.error(LogComponent.API, 'Wolf events stream error', error);
            sendSSEData({ 
              type: 'error', 
              message: 'Stream error occurred',
              error: error.message,
              timestamp: new Date().toISOString() 
            }, 'error');
          });

        } catch (connectionError) {
          logger.error(LogComponent.API, 'Failed to connect to Wolf events stream', connectionError);
          sendSSEData({ 
            type: 'error', 
            message: 'Failed to connect to Wolf events',
            error: connectionError instanceof Error ? connectionError.message : String(connectionError),
            timestamp: new Date().toISOString() 
          }, 'error');
          
          // Close the SSE stream on connection failure
          try {
            controller.close();
          } catch (closeError) {
            logger.debug(LogComponent.API, 'Controller already closed', closeError);
          }
        }

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          logger.info(LogComponent.API, 'Wolf events SSE client disconnected', {
            userId: session.user.id
          });
          
          if (eventStream) {
            try {
              eventStream.destroy();
            } catch (destroyError) {
              logger.debug(LogComponent.API, 'Error destroying Wolf event stream', destroyError);
            }
          }
          
          try {
            controller.close();
          } catch (closeError) {
            logger.debug(LogComponent.API, 'Controller already closed', closeError);
          }
        });
      },

      cancel() {
        logger.info(LogComponent.API, 'Wolf events SSE stream cancelled');
      }
    });

    // Return SSE response with proper headers
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    logger.error(LogComponent.API, 'Error in Wolf events SSE endpoint', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}