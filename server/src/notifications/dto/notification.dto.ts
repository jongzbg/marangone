import { IsOptional, IsString, IsIn } from 'class-validator'

export class CreateNotificationDto {
  @IsString()
  @IsIn(['LIKE', 'COMMENT', 'REPOST', 'QUOTE', 'MESSAGE', 'FOLLOW'])
  type: string

  @IsString()
  userId: string  // Recipient

  @IsString()
  actorId: string  // Who triggered

  @IsOptional()
  @IsString()
  postId?: string

  @IsOptional()
  @IsString()
  messageId?: string

  @IsOptional()
  @IsString()
  conversationId?: string
}