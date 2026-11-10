// Weather for a saved location (Open-Meteo, no key): the one-line current
// conditions used by /daily, and a 24-hour + 5-day forecast for the widget.
import { getJson, safely } from '../http.js';
import { cached } from '../store.js';

const CODES = {
  0: ['☀️', 'Clear'], 1: ['🌤', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫', 'Fog'], 48: ['🌫', 'Rime fog'], 51: ['🌦', 'Light drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌧', 'Heavy drizzle'],
  61: ['🌧', 'Light rain'], 63: ['🌧', 'Rain'], 65: ['🌧', 'Heavy rain'], 71: ['🌨', 'Light snow'], 73: ['🌨', 'Snow'],
  75: ['❄️', 'Heavy snow'], 80: ['🌦', 'Showers'], 81: ['🌧', 'Showers'], 82: ['⛈', 'Violent showers'],
  95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunderstorm, hail'], 99: ['⛈', 'Thunderstorm, hail'],
};

export const describeCode = (code) => CODES[code] ?? ['🌡', 'Weather'];

export function getWeather(lat, lon) {
  return safely(async () => {
    const d = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1',
    );
    const [icon, label] = describeCode(d.current?.weather_code);
    return {
      icon, label,
      code: d.current?.weather_code,
      temp: d.current?.temperature_2m,
      wind: d.current?.wind_speed_10m,
      max: d.daily?.temperature_2m_max?.[0],
      min: d.daily?.temperature_2m_min?.[0],
    };
  });
}

// Current conditions, the next 24 hours and 5 days (cached 15 min per ~1 km cell).
// → { offset (location's UTC offset, s), temp, code, label, icon, wind, max, min, hours: [{ t, temp, rain, code, night }], days: [{ t, code, max, min }] }
export function getForecast(lat, lon) {
  const la = Number(lat).toFixed(2);
  const lo = Number(lon).toFixed(2);
  return cached(`wx:${la},${lo}`, 900, () => safely(async () => {
    const d = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&timezone=auto&timeformat=unixtime&forecast_days=6` +
      '&current=temperature_2m,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min',
    );
    const now = Math.floor(Date.now() / 1000);
    const h = d.hourly ?? {};
    const first = Math.max(0, (h.time ?? []).findIndex((t) => t > now - 3600));
    const hours = (h.time ?? []).slice(first, first + 24).map((t, i) => ({
      t, temp: h.temperature_2m?.[first + i], rain: h.precipitation_probability?.[first + i] ?? 0,
      code: h.weather_code?.[first + i] ?? 0, night: h.is_day?.[first + i] === 0,
    }));
    const dl = d.daily ?? {};
    const days = (dl.time ?? []).slice(0, 5).map((t, i) => ({
      // Daily times are local midnight; noon keeps the weekday right in any zone.
      t: t + 12 * 3600, code: dl.weather_code?.[i], max: dl.temperature_2m_max?.[i], min: dl.temperature_2m_min?.[i],
    }));
    const [icon, label] = describeCode(d.current?.weather_code);
    return {
      offset: d.utc_offset_seconds ?? 0,
      temp: d.current?.temperature_2m, code: d.current?.weather_code, icon, label, wind: d.current?.wind_speed_10m,
      max: days[0]?.max, min: days[0]?.min, hours, days,
    };
  }));
}
