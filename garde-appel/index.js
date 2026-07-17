import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent appelle AppRegistry.registerComponent('main', () => App)
// et configure l'environnement, que l'app soit lancée via Expo Go ou en build natif.
registerRootComponent(App);
