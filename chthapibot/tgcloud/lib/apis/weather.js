// Current weather for a saved location (Open-Meteo, no key), used by /daily.
import { getJson, safely } from '../http.js';

const CODES = {
  0: ['☀️', 'Clear'], 1: ['🌤', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫', 'Fog'], 48: ['🌫', 'Rime fog'], 51: ['🌦', 'Light drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌧', 'Heavy drizzle'],
  61: ['🌧', 'Light rain'], 63: ['🌧', 'Rain'], 65: ['🌧', 'Heavy rain'], 71: ['🌨', 'Light snow'], 73: ['🌨', 'Snow'],
  75: ['❄️', 'Heavy snow'], 80: ['🌦', 'Showers'], 81: ['🌧', 'Showers'], 82: ['⛈', 'Violent showers'],
  95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunderstorm, hail'], 99: ['⛈', 'Thunderstorm, hail'],
};

export function getWeather(lat, lon) {
  return safely(async () => {
    const d = await getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1',
    );
    const [icon, label] = CODES[d.current?.weather_code] ?? ['🌡', 'Weather'];
    return {
      icon, label,
      temp: d.current?.temperature_2m,
      wind: d.current?.wind_speed_10m,
      max: d.daily?.temperature_2m_max?.[0],
      min: d.daily?.temperature_2m_min?.[0],
    };
  });
}
