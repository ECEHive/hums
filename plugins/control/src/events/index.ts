// Control plugin event declarations
// Extends HumsEventMap for EventBus
declare module '@ecehive/core' {
  interface HumsEventMap {
    'control:point-operated': {
      controlPointId: string;
      userId: string;
      operation: string;
      timestamp: Date;
    };
    'control:gateway-invoked': {
      gatewayId: string;
      userId: string;
      actions: Array<{ controlPointId: string; operation: string; result: string }>;
      timestamp: Date;
    };
  }
}
