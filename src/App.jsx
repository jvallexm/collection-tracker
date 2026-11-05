import { SET_CODE, SET_NAME } from './config.js';
import SetTracker from './components/SetTracker.jsx';

export default function App() {
  return <SetTracker setCode={SET_CODE} setName={SET_NAME} />;
}
