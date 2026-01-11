import { WebSocket } from "ws";
import { OutgoingMessage } from "./types/out";
import { SubscriptionManager } from "./SubscriptionManager";
import { IncomingMessage, SUBSCRIBE, UNSUBSCRIBE, AUTH } from "./types/in";
import jwt from "jsonwebtoken";
import { config } from "./config";

const JWT_SECRET = config.auth.jwtSecret;
const REFRESH_SECRET = config.auth.refreshSecret;

export class User {
  private id: string;
  private ws: WebSocket;
  private authenticated: boolean = false;
  private authenticatedUserId: string | null = null;

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.addListeners();
  }

  public getId() {
    return this.id;
  }

  public getAuthenticatedUserId() {
    return this.authenticatedUserId;
  }

  public isAuthenticated() {
    return this.authenticated;
  }

  private subscriptions: string[] = [];

  public subscribe(subscription: string) {
    this.subscriptions.push(subscription);
  }

  public unsubscribe(subscription: string) {
    this.subscriptions = this.subscriptions.filter((s) => s !== subscription);
  }

  emit(message: OutgoingMessage) {
    this.ws.send(JSON.stringify(message));
  }

  private sendError(message: string) {
    this.ws.send(JSON.stringify({
      type: "error",
      message
    }));
  }

  private validateUserScopedSubscription(subscription: string): boolean {
    // Check if this is a user-scoped channel
    if (subscription.startsWith("open_orders:user:")) {
      if (!this.authenticated) {
        this.sendError("Authentication required for user-scoped subscriptions");
        return false;
      }

      // Extract userId from subscription channel
      const parts = subscription.split(":");
      if (parts.length !== 3) {
        this.sendError("Invalid subscription format");
        return false;
      }

      const requestedUserId = parts[2];

      // Debug log for troubleshooting
      console.log(`[WS] Subscription validation: requested=${requestedUserId}, authenticated=${this.authenticatedUserId}, match=${requestedUserId === this.authenticatedUserId}`);

      // Verify user is only subscribing to their own channel
      if (requestedUserId !== this.authenticatedUserId) {
        this.sendError("Unauthorized: Cannot subscribe to another user's channel");
        console.warn(`[WS] User ${this.authenticatedUserId} attempted to subscribe to ${subscription}`);
        return false;
      }
    }

    return true;
  }

  private addListeners() {
    this.ws.on("message", (message: string) => {
      try {
        const parsedMessage: IncomingMessage = JSON.parse(message);

        if (parsedMessage.method === AUTH) {
          if (!parsedMessage.params || parsedMessage.params.length < 1) {
            this.sendError("Authentication token required");
            return;
          }

          const accessToken = parsedMessage.params[0];
          const refreshToken = parsedMessage.params[1];

          try {
            const decoded = jwt.verify(accessToken, JWT_SECRET) as { userId: number | string };

            this.authenticated = true;
            this.authenticatedUserId = String(decoded.userId); // Convert to string for consistent comparison


          } catch (accessError) {
            if (!refreshToken) {
              this.sendError("Invalid or expired token");
              return;
            }

            try {
              const decodedRefresh = jwt.verify(
                refreshToken,
                REFRESH_SECRET
              ) as { userId: number | string };

              this.authenticated = true;
              this.authenticatedUserId = String(decodedRefresh.userId); // Convert to string for consistent comparison


            } catch (refreshError) {
              this.sendError("Invalid authentication token");
              return;
            }
          }

          console.log(`[WS] User ${this.id} authenticated as ${this.authenticatedUserId}`);

          this.ws.send(
            JSON.stringify({
              type: "auth_success",
              userId: this.authenticatedUserId,
            })
          );

          return;
        }


        if (parsedMessage.method === SUBSCRIBE) {
          parsedMessage.params.forEach((s) => {
            // Validate user-scoped subscriptions
            if (this.validateUserScopedSubscription(s)) {
              SubscriptionManager.getInstance().subscribe(this.id, s, this.authenticatedUserId);
            }
          });
        }

        if (parsedMessage.method === UNSUBSCRIBE) {
          parsedMessage.params.forEach((s) =>
            SubscriptionManager.getInstance().unsubscribe(this.id, s)
          );
        }
      } catch (error) {
        this.sendError("Invalid message format");
        console.error(`[WS] Error processing message from user ${this.id}:`, error);
      }
    });
  }
}
