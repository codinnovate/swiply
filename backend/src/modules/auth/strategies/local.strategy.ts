import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { ApiException } from '../../../common/errors/api.exception';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<UserDocument> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw ApiException.unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password');
    }
    return user;
  }
}
