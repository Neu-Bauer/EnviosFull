import { Router } from 'express';
import { autenticarToken, somenteTenant, exigirModulo } from '../middlewares/authMiddleware.js';
import {
  exigirSenhaMascara,
  verificarSenha,
  definirSenha,
  listarMascaras,
  sincronizarMascaras,
} from '../controllers/mascaraAdminController.js';

const router = Router();

router.use(autenticarToken, somenteTenant, exigirModulo('full'));

router.put('/senha', definirSenha);
router.post('/senha/verificar', verificarSenha);

router.get('/', exigirSenhaMascara, listarMascaras);
router.put('/sincronizar', exigirSenhaMascara, sincronizarMascaras);

export default router;
