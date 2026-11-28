import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register() {
    throw new ForbiddenException(
      'Account creation is disabled. Sign in with Default Admin or your SalesBuster Sales Manager account.',
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.userId, body.oldPassword, body.newPassword);
  }
}
