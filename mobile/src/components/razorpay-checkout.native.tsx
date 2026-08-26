import { Modal, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { RazorpayCheckoutProps } from '@/components/razorpay-checkout';

// Unverified beyond code review: react-native-webview needs a native build
// (dev client / EAS), which this project can't produce or run here. Loads a
// small HTML page that opens Razorpay's checkout.js and bridges the result
// back via postMessage, mirroring the web implementation's approach.
function buildCheckoutHtml(props: RazorpayCheckoutProps): string {
  const options = {
    key: props.keyId,
    order_id: props.orderId,
    amount: props.amount,
    currency: props.currency,
    name: props.name,
    description: props.description,
    prefill: props.prefill,
  };

  return `<!DOCTYPE html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;">
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      var options = ${JSON.stringify(options)};
      options.handler = function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'success',
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature
        }));
      };
      options.modal = {
        ondismiss: function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
        },
      };
      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', reason: response.error.description }));
        });
        rzp.open();
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failure', reason: String(err) }));
      }
    </script>
  </body>
</html>`;
}

export function RazorpayCheckout(props: RazorpayCheckoutProps) {
  if (!props.visible) return null;

  function handleMessage(event: WebViewMessageEvent) {
    const message = JSON.parse(event.nativeEvent.data) as
      | { type: 'success'; paymentId: string; orderId: string; signature: string }
      | { type: 'failure'; reason: string }
      | { type: 'dismiss' };

    if (message.type === 'success') {
      props.onSuccess({
        paymentId: message.paymentId,
        orderId: message.orderId,
        signature: message.signature,
      });
    }
    else if (message.type === 'failure') props.onFailure(message.reason);
    else props.onDismiss();
  }

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onDismiss}>
      <WebView
        source={{ html: buildCheckoutHtml(props) }}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
  },
});
