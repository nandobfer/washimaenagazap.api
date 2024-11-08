import { Prisma } from "@prisma/client"
import { prisma } from "../prisma"
import axios, { AxiosError, AxiosInstance } from "axios"
import { OvenForm, WhatsappApiForm, WhatsappForm, WhatsappTemplateComponent } from "../types/shared/Meta/WhatsappBusiness/WhatsappForm"
import { UploadedFile } from "express-fileupload"
import * as fs from "fs"
import { getIoInstance } from "../io/socket"
import { FailedMessageLog, SentMessageLog } from "../types/shared/Meta/WhatsappBusiness/Logs"
import { HandledError, HandledErrorCode } from "./HandledError"
import { WithoutFunctions } from "./helpers"
import { User } from "./User"

export type NagaMessagePrisma = Prisma.NagazapMessageGetPayload<{}>
export type NagaMessageForm = Omit<Prisma.NagazapMessageGetPayload<{}>, "id">
export const nagazap_include = Prisma.validator<Prisma.NagazapInclude>()({ user: true })
export type NagazapPrisma = Prisma.NagazapGetPayload<{ include: typeof nagazap_include }>
interface BuildHeadersOptions {
    upload?: boolean
}
export class NagaMessage {
    id: number
    from: string
    timestamp: string
    text: string
    name: string

    constructor(data: NagaMessagePrisma) {
        this.id = data.id
        this.from = data.from
        this.timestamp = data.timestamp
        this.text = data.text
        this.name = data.name
    }
}

const api = axios.create({
    baseURL: "https://graph.facebook.com/v19.0",
    // headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
})

export interface NagazapForm {
    token: string
    appId: string
    phoneId: string
    businessId: string
    userId: string
}

export class Nagazap {
    id: number
    token: string
    appId: string
    phoneId: string
    businessId: string
    lastUpdated: string
    stack: WhatsappForm[]
    blacklist: string[]
    frequency: string
    batchSize: number
    lastMessageTime: string
    paused: boolean
    sentMessages: SentMessageLog[]
    failedMessages: FailedMessageLog[]

    userId: string
    user: User

    static async initialize() {
        await Nagazap.shouldBake()
        setInterval(() => Nagazap.shouldBake(), 1 * 5 * 1000)
    }

    static async new(data: NagazapForm) {
        const new_nagazap = await prisma.nagazap.create({
            data: {
                appId: data.appId,
                businessId: data.businessId,
                phoneId: data.phoneId,
                token: data.token,
                userId: data.userId,

                batchSize: 20,
                frequency: "60000",
                paused: true,
                lastUpdated: new Date().getTime().toString(),
                lastMessageTime: "",

                blacklist: "[]",
                failedMessages: "[]",
                sentMessages: "[]",
                stack: "[]",
            },
            include: nagazap_include,
        })

        const nagazap = new Nagazap(new_nagazap)
        return nagazap
    }

    static async getByUserId(user_id: string) {
        const data = await prisma.nagazap.findMany({ where: { userId: user_id }, include: nagazap_include })
        return data.map((item) => new Nagazap(item))
    }

    static async getAll() {
        const data = await prisma.nagazap.findMany({ include: nagazap_include })
        return data.map((item) => new Nagazap(item))
    }

    static async shouldBake() {
        const nagazaps = await Nagazap.getAll()
        nagazaps.forEach((nagazap) => {
            try {
                if (!nagazap.stack.length) return

                const lastTime = new Date(Number(nagazap.lastMessageTime || 0))
                const now = new Date()
                if (now.getTime() >= lastTime.getTime() + Number(nagazap.frequency) && !!nagazap.stack.length && !nagazap.paused) {
                    nagazap.bake()
                }
            } catch (error) {
                if (error instanceof HandledError && error.code === HandledErrorCode.no_nagazap) {
                } else {
                    console.log(error)
                }
            }
        })
    }

    constructor(data: NagazapPrisma) {
        this.id = data.id
        this.token = data.token
        this.appId = data.appId
        this.phoneId = data.phoneId
        this.businessId = data.businessId
        this.lastUpdated = data.lastUpdated
        this.stack = JSON.parse(data.stack)
        this.blacklist = JSON.parse(data.blacklist)
        this.frequency = data.frequency
        this.batchSize = data.batchSize
        this.lastMessageTime = data.lastMessageTime
        this.paused = data.paused
        this.sentMessages = JSON.parse(data.sentMessages)
        this.failedMessages = JSON.parse(data.failedMessages)
        this.userId = data.userId
        this.user = new User(data.user)
    }

    async getMessages() {
        const data = await prisma.nagazapMessage.findMany()
        const messages = data.map((item) => new NagaMessage(item))
        return messages
    }

    async updateToken(token: string) {
        const data = await prisma.nagazap.update({ where: { id: this.id }, data: { token, lastUpdated: new Date().getTime().toString() } })
        this.token = data.token
        this.lastUpdated = data.lastUpdated
        this.emit()
    }

    buildHeaders(options?: BuildHeadersOptions) {
        return { Authorization: `Bearer ${this.token}`, "Content-Type": options?.upload ? "multipart/form-data" : "application/json" }
    }

    async getInfo() {
        const response = await api.get(`/${this.businessId}?fields=id,name,phone_numbers`, {
            headers: this.buildHeaders(),
        })

        console.log(JSON.stringify(response.data, null, 4))
        return response.data
    }

    async saveMessage(data: NagaMessageForm) {
        const prisma_message = await prisma.nagazapMessage.create({
            data: {
                ...data,
                timestamp: (Number(data.timestamp) * 1000).toString(),
            },
        })

        const message = new NagaMessage(prisma_message)
        const io = getIoInstance()
        io.emit("nagazap:message", message)

        if (message.text.toLowerCase() == "parar promoções") {
            this.addToBlacklist(message.from)
        }
        return message
    }

    async addToBlacklist(number: string) {
        if (this.blacklist.includes(number)) return
        this.blacklist.push(number)
        await prisma.nagazap.update({ where: { id: this.id }, data: { blacklist: JSON.stringify(this.blacklist) } })
        console.log(`número ${number} adicionado a blacklist`)
        this.emit()
    }

    async removeFromBlacklist(number: string) {
        if (!this.blacklist.includes(number)) return
        this.blacklist = this.blacklist.filter((item) => item != number)
        await prisma.nagazap.update({ where: { id: this.id }, data: { blacklist: JSON.stringify(this.blacklist) } })
        console.log(`número ${number} removido da blacklist`)
        this.emit()
    }

    async getTemplates() {
        const response = await api.get(`/${this.businessId}?fields=id,name,message_templates`, {
            headers: this.buildHeaders(),
        })

        const templates = response.data.message_templates.data
        console.log(templates)
        return templates
    }

    async uploadMedia(file: UploadedFile, filepath: string) {
        const response = await api.post(
            `/${this.phoneId}/media`,
            {
                messaging_product: "whatsapp",
                type: file.mimetype,
                file: fs.createReadStream(filepath),
            },
            { headers: this.buildHeaders({ upload: true }) }
        )
        console.log(response.data.id)
        return response.data.id as string
    }

    async sendMessage(message: WhatsappForm) {
        const number = message.number.toString().replace(/\D/g, "")
        if (this.blacklist.includes(number.length == 10 ? number : number.slice(0, 2) + number.slice(3))) {
            console.log(`mensagem não enviada para ${number} pois está na blacklist`)
            return
        }

        const form: WhatsappApiForm = {
            messaging_product: "whatsapp",
            template: {
                language: { code: message.language },
                name: message.template,
                components: message.components,
            },
            type: "template",
            to: "+55" + number,
        }

        try {
            const whatsapp_response = await api.post(`/${this.phoneId}/messages`, form, { headers: this.buildHeaders() })
            console.log(whatsapp_response.data)
            this.log(whatsapp_response.data)
        } catch (error) {
            if (error instanceof AxiosError) {
                console.log(error.response?.data)
                this.errorLog(error.response?.data, number)
            } else {
                console.log(error)
            }
        }
    }

    async queueMessage(data: WhatsappForm) {
        this.stack.push(data)
        await prisma.nagazap.update({ where: { id: this.id }, data: { stack: JSON.stringify(this.stack) } })

        return this.stack
    }

    async queueBatch(data: WhatsappForm[]) {
        this.stack = [...this.stack, ...data]
        await prisma.nagazap.update({ where: { id: this.id }, data: { stack: JSON.stringify(this.stack) } })

        return this.stack
    }

    async prepareBatch(data: OvenForm, image_id = "") {
        const forms: WhatsappForm[] = data.to.map((number) => {
            return {
                number,
                template: data.template!.name,
                language: data.template!.language,
                components: data
                    .template!.components.filter((component) => component.format == "IMAGE")
                    .map((component) => {
                        const component_data: WhatsappTemplateComponent = {
                            type: component.type.toLowerCase() as "header" | "body" | "footer",
                            parameters: component.format == "IMAGE" ? [{ type: "image", image: { id: image_id } }] : [],
                        }
                        return component_data
                    }),
            }
        })

        await this.queueBatch(forms)
    }

    async updateOvenSettings(data: { batchSize?: number; frequency?: string }) {
        const updated = await prisma.nagazap.update({ where: { id: this.id }, data })
        this.batchSize = updated.batchSize
        this.frequency = updated.frequency
        this.emit()
    }

    async saveStack() {
        this.lastMessageTime = new Date().getTime().toString()
        const data = await prisma.nagazap.update({
            where: { id: this.id },
            data: { stack: JSON.stringify(this.stack), lastMessageTime: this.lastMessageTime },
        })
        this.emit()
    }

    async bake() {
        const batch = this.stack.slice(0, this.batchSize)
        const sent = await Promise.all(batch.map(async (message) => this.sendMessage(message)))

        this.stack = this.stack.slice(this.batchSize)
        await this.saveStack()
    }

    async pause() {
        this.paused = true
        await prisma.nagazap.update({ where: { id: this.id }, data: { paused: this.paused } })
        this.emit()
    }

    async start() {
        this.paused = false
        await prisma.nagazap.update({ where: { id: this.id }, data: { paused: this.paused } })
        this.emit()
    }

    async clearOven() {
        this.stack = []
        await prisma.nagazap.update({ where: { id: this.id }, data: { stack: JSON.stringify(this.stack) } })
        this.emit()
    }

    async log(data: any) {
        this.sentMessages.push({ timestamp: new Date().getTime().toString(), data })
        await prisma.nagazap.update({ where: { id: this.id }, data: { sentMessages: JSON.stringify(this.sentMessages) } })
    }

    async errorLog(data: any, number: string) {
        this.failedMessages.push({ timestamp: new Date().getTime().toString(), data, number })
        await prisma.nagazap.update({ where: { id: this.id }, data: { failedMessages: JSON.stringify(this.failedMessages) } })
    }

    emit() {
        const io = getIoInstance()
        io.emit("nagazap:update", this)
    }
}
