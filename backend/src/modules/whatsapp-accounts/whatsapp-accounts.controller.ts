import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { WhatsAppAccountsService } from "./whatsapp-accounts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("whatsapp/accounts")
@UseGuards(JwtAuthGuard)
export class WhatsAppAccountsController {
  constructor(private readonly accountsService: WhatsAppAccountsService) {}

  @Get()
  async getAccounts(@Request() req: any) {
    return this.accountsService.getOrganizationAccounts(
      req.user.organizationId,
    );
  }

  @Post("connect")
  async connectAccount(
    @Request() req: any,
    @Body()
    body: {
      virtualNumberId?: string;
      displayNumber: string;
      externalAccountId: string;
      provider?: string;
    },
  ) {
    return this.accountsService.connectAccount(req.user.organizationId, body);
  }
}
