// A query from a message widget (TelegramWidget.request). Payload is the WidgetQuery;
// routing and the answer live in lib/widgets.
import { onWidgetQuery } from '../lib/widgets/index.js';
import '../lib/hubs/index.js'; // registers the widget sources

export default (q) => onWidgetQuery(q);
