// A query from a shared message widget. Payload is the SharedWidgetQuery; it is
// handled like any widget query (lib/widgets), and the answer refreshes the
// shared widget for everyone.
import { onWidgetQuery } from '../lib/widgets/index.js';
import '../lib/hubs/index.js'; // registers the widget sources

export default (q) => onWidgetQuery(q);
