import './styles.css';
import { register, start } from './app/router';
import { homeScreen } from './app/home';
import { scanScreen } from './scan/scan-screen';
import { solveScreen } from './solve/solve-screen';
import { warmUpSolver } from './solve/fast-solve';

register('home', homeScreen);
register('scan', scanScreen);
register('solve', solveScreen);

warmUpSolver();
start();
