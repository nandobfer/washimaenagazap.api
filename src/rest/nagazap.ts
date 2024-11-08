import express, { Express, Request, Response } from "express"
import { OvenForm, WhatsappApiForm, WhatsappForm, WhatsappTemplateComponent } from "../types/shared/Meta/WhatsappBusiness/WhatsappForm"
import { addMessageToStack, api as zapApi } from "../api/whatsapp/meta"
import { AxiosError } from "axios"
import { MessageWebhook } from "../types/shared/Meta/WhatsappBusiness/MessageWebhook"
import { Nagazap, NagazapForm } from "../class/Nagazap"
import { UploadedFile } from "express-fileupload"
import { saveFile } from "../tools/saveFile"

const router = express.Router()

export const getNumbers = (original_number: string | number) => {
    const number = `55${original_number}@c.us`

    const prefix = number.slice(2, 4)
    const number2 = `55${prefix + number.slice(5)}`
    return [number, number2]
}

router.get("/", async (request: Request, response: Response) => {
    const user_id = request.query.user_id as string | undefined
    const nagazap_id = request.query.nagazap_id as string | undefined

    console.log(user_id)
    if (user_id) {
        if (nagazap_id) {
            // a single nagazap
        } else {
            try {
                const nagazaps = await Nagazap.getByUserId(user_id)
                response.json(nagazaps)
            } catch (error) {
                console.log(error)
                response.status(500).send(error)
            }
        }
    } else {
        response.status(400).send("user_id param is required")
    }
})

router.post("/", async (request: Request, response: Response) => {
    const data = request.body as NagazapForm

    try {
        const nagazap = await Nagazap.new(data)
        response.json(nagazap)
    } catch (error) {
        console.log(error)
        response.status(500).send(error)
    }
})

// router.get("/info", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         const info = await nagazap.getInfo()
//         response.json(info)
//     } catch (error) {
//         response.status(500).send(error)
//         if (error instanceof AxiosError) {
//             console.log(error.response?.data)
//         } else {
//             console.log(error)
//         }
//     }
// })

// router.get("/templates", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         const templates = await nagazap.getTemplates()
//         response.json(templates)
//     } catch (error) {
//         response.status(500).send(error)
//         if (error instanceof AxiosError) {
//             console.log(error.response?.data)
//         } else {
//             console.log(error)
//         }
//     }
// })


// router.patch("/token", async (request: Request, response: Response) => {
//     const data = request.body as { token: string }
//     console.log(data)
//     if (data.token) {
//         try {
//             const nagazap = await Nagazap.get()
//             await nagazap.updateToken(data.token)
//             response.json(nagazap)
//         } catch (error) {
//             console.log(error)
//             response.status(500).send(error)
//         }
//     } else {
//         response.status(400).send("missing token attribute")
//     }
// })

// router.get("/messages", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         const messages = await nagazap.getMessages()
//         response.json(messages)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// // router.post("/", async (request: Request, response: Response) => {
// //     const data = request.body as WhatsappForm

// //     try {
// //         const new_message_index = addMessageToStack(data)
// //         console.log({ queued_message_number: data.number, template: data.template, new_message_index })
// //         response.json(new_message_index)
// //     } catch (error) {
// //         if (error instanceof AxiosError) {
// //             console.log(error.response?.data)
// //         } else {
// //             console.log(error)
// //         }
// //         response.status(500).send(error)
// //     }
// // })

// router.get("/messages_webhook", async (request: Request, response: Response) => {
//     const mode = request.query["hub.mode"]

//     if (mode == "subscribe") {
//         try {
//             const challenge = request.query["hub.challenge"]

//             response.status(200).send(challenge)
//         } catch (error) {
//             console.log(error)
//             response.status(500).send(error)
//         }
//     } else {
//         response.status(400).send("hub.mode should be subscribe")
//     }
// })

// router.post("/messages_webhook", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         const data = request.body as MessageWebhook
//         data.entry?.forEach(async (entry) => {
//             entry.changes?.forEach(async (change) => {
//                 if (change.field !== "messages") return
//                 change.value.messages?.forEach(async (message) => {
//                     console.log(message)
//                     // nagazap.saveMessage({
//                     //     from: message.from.slice(2),
//                     //     text: message.text?.body || message.button?.text || "**ERRO**",
//                     //     timestamp: message.timestamp,
//                     //     name: change.value.contacts[0].profile?.name || "",
//                     // })
//                 })
//             })
//         })
//         response.status(200).send()
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.get("/media_webhook", async (request: Request, response: Response) => {
//     const mode = request.query["hub.mode"]

//     if (mode == "subscribe") {
//         try {
//             const challenge = request.query["hub.challenge"]

//             response.status(200).send(challenge)
//         } catch (error) {
//             console.log(error)
//             response.status(500).send(error)
//         }
//     } else {
//         response.status(400).send("hub.mode should be subscribe")
//     }
// })

// router.post("/media_webhook", async (request: Request, response: Response) => {
//     const data = request.body

//     try {
//         console.log(JSON.stringify(data, null, 4))
//         response.status(200).send()
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.post("/oven", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         let image_id = ""

//         const data = JSON.parse(request.body.data) as OvenForm
//         console.log(`quantidade de contatos: ${data.to.length}`)
//         if (!data.template) {
//             response.status(400).send("template is required")
//             return
//         }

//         if (request.files) {
//             const file = request.files.file as UploadedFile
//             file.name = file.name.replace(/[\s\/\\?%*:|"<>]+/g, "-").trim()
//             const uploaded = saveFile("nagazap/image", { name: file.name, file: file.data }, async () => {
//                 image_id = await nagazap.uploadMedia(file, uploaded.filepath)
//                 await nagazap.prepareBatch(data, image_id)
//                 response.send("teste")
//             })
//         } else {
//             await nagazap.prepareBatch(data, image_id)
//             response.send("teste")
//         }
//     } catch (error) {
//         console.log(error)
//         if (error instanceof AxiosError) {
//             console.log(error.response?.data)
//         }
//         response.status(500).send(error)
//     }
// })

// router.patch("/", async (request: Request, response: Response) => {
//     const data = request.body as { batchSize?: number; frequency?: string }

//     try {
//         const nagazap = await Nagazap.get()
//         await nagazap.updateOvenSettings(data)
//         response.json(nagazap)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.delete("/blacklist", async (request: Request, response: Response) => {
//     const data = request.body as { number: string }

//     try {
//         const nagazap = await Nagazap.get()
//         await nagazap.removeFromBlacklist(data.number)
//         response.json(nagazap)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.get("/pause", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         await nagazap.pause()
//         response.json(nagazap)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.get("/start", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         await nagazap.start()
//         response.json(nagazap)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

// router.get("/clearOven", async (request: Request, response: Response) => {
//     try {
//         const nagazap = await Nagazap.get()
//         await nagazap.clearOven()
//         response.json(nagazap)
//     } catch (error) {
//         console.log(error)
//         response.status(500).send(error)
//     }
// })

export default router
