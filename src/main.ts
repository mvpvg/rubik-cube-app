import './styles.css';
import { register, start } from './app/router';
import { homeScreen } from './app/home';
import { solveScreen } from './solve/solve-screen';
import { warmUpSolver } from './solve/fast-solve';

register('home', homeScreen);
register('solve', solveScreen);

warmUpSolver();
start();
