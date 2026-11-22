import './styles.css';
import { register, start } from './app/router';
import { homeScreen } from './app/home';

register('home', homeScreen);

start();
