import { Machine, interpret } from "xstate";

interface Context {
  provider?: string;
  plan?: string;
}

interface Schema {
  states: {
    free: {};
    expired: {
      states: {
        churned: {};
        inBillingRetry: {};
      };
    };
    subscribed: {
      states: {
        autoRenewing: {};
        expiring: {};
        inGracePeriod: {};
      };
    };
  };
}

type Event =
  | { type: "START" }
  | { type: "RENEW" }
  | { type: "CANCEL" }
  | { type: "REFUND" }
  | { type: "EXPIRE" }
  | { type: "BILLING_ERROR" }
  | { type: "RECOVER" }
  | { type: "RESTART" }
  | { type: "GRACE_PERIOD_END" }
  | { type: "FAILED_TO_RECOVER" }
  | { type: "RETAIN" }
  | { type: "WIN_BACK" };

const machine = Machine<Context, Schema, Event>({
  key: "subscription",
  initial: "free",
  context: { provider: undefined },
  states: {
    free: {
      on: { START: "subscribed" },
    },
    expired: {
      initial: "churned",
      states: {
        churned: {
          on: {
            RESTART: "#subscription.subscribed",
            WIN_BACK: "#subscription.subscribed",
          },
        },
        inBillingRetry: {
          on: {
            RECOVER: "#subscription.subscribed",
            RESTART: "#subscription.subscribed",
            WIN_BACK: "#subscription.subscribed",
            FAILED_TO_RECOVER: "churned",
          },
        },
      },
    },
    subscribed: {
      initial: "autoRenewing",
      states: {
        autoRenewing: {
          on: {
            RENEW: "autoRenewing",
            CANCEL: "expiring",
            REFUND: "#subscription.expired",
            BILLING_ERROR: "inGracePeriod",
          },
        },
        expiring: {
          on: {
            EXPIRE: "#subscription.expired",
            RETAIN: "autoRenewing",
            RESTART: "autoRenewing",
          },
        },
        inGracePeriod: {
          on: {
            RECOVER: "autoRenewing",
            GRACE_PERIOD_END: "#subscription.expired.inBillingRetry",
          },
        },
      },
    },
  },
});

const service = interpret(machine).onTransition((state, event) => {
  console.log(event.type);
});

const initialState = "free";

// Start the service
service.start(initialState);
console.log(service.state.value);

const events: Event[] = [
  { type: "START" },
  { type: "RENEW" },
  { type: "RENEW" },
  { type: "CANCEL" },
  { type: "RESTART" },
  { type: "RENEW" },
  { type: "RENEW" },
  { type: "BILLING_ERROR" },
  { type: "RECOVER" },
  { type: "BILLING_ERROR" },
  { type: "GRACE_PERIOD_END" },
  { type: "FAILED_TO_RECOVER" },
];

// Send events
events.forEach((e) => {
  service.send(e);
  console.log(service.state.value);
});

// Stop the service when you are no longer using it.
service.stop();
