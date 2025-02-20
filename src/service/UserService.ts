import { randomBytes } from "crypto";
import Service from "@/service/Service";
import { User } from "@prisma/client";

class UserService extends Service {
  public static async createUser(address: string, password?: string|null): Promise<User> {
    try {
      const randomUsername = `user_${randomBytes(4).toString("hex")}`;

      return await this.prisma.user.create({
        data: {
          username: randomUsername,
          address: address,
          password,
          point: 0
        }
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  public static async getUserByID(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id }
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  public static async getUserByAddress(address: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { address }
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  public static async updateUsername(userId: string, username: string): Promise<User> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { username }
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}

export default UserService;
