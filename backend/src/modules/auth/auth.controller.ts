import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest, AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create an account, its default workspace, and return a JWT' })
  async register(@Body() dto: RegisterDto) {
    return { data: await this.authService.register(dto) };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email + password for a JWT' })
  async login(@Req() request: AuthenticatedRequest, @Body() _dto: LoginDto) {
    // LocalAuthGuard has already replaced request.user with the UserDocument.
    const user = request.user as unknown as UserDocument;
    return { data: await this.authService.login(user) };
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Begin Google OAuth sign-in' })
  googleAuth(): void {
    // GoogleAuthGuard issues the redirect; this handler is never reached.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    const user = request.user as unknown as UserDocument;
    const result = await this.authService.login(user);
    const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');

    // The token goes back through the fragment so it never lands in server logs
    // or the Referer header on the frontend's next request.
    response.redirect(`${frontendUrl}/auth/callback#access_token=${result.accessToken}`);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'The authenticated user' })
  async me(@CurrentUser() principal: AuthenticatedUser) {
    const user = await this.usersService.findById(principal.userId);
    return {
      data: {
        id: principal.userId,
        email: principal.email,
        name: user?.name ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        emailVerified: user?.emailVerified ?? false,
        defaultWorkspaceId: principal.defaultWorkspaceId,
      },
    };
  }
}
